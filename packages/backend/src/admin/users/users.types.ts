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
  // Usage — see users-batch-fetch.helper.ts for what each is sourced from and
  // why (replaced Saved Queries/Watchlist/Alerts, which were 0 for every user
  // in the product, not just this one — uninformative on a per-user view).
  overrideCount: number;
  paywallHits: number;
  reportsGenerated: number;
  scoreViews: number;
  analyzerRuns: number;
  /** Minutes from signup to first score view / analyzer run / report — the
   * activation signal. Null when neither has happened yet. */
  timeToFirstValueMinutes: number | null;
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
