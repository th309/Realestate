'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  User,
  Shield,
  Plus,
  Trash2,
  Check,
  X,
  ChevronDown,
  Clock,
  Loader2,
  RefreshCw,
  AlertCircle,
  Building2,
  CreditCard,
  Beaker,
  Star,
  BarChart3,
  Bell,
  Eye,
  FileText,
  Bookmark,
} from 'lucide-react';
import { fetchAPIRaw } from '@/lib/data';

// Types
interface UserOverride {
  id: string;
  feature_slug: string;
  feature_name: string;
  value: boolean | number;
  reason?: string;
  created_at: string;
  expires_at?: string;
}

interface UserData {
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
  // For detail view
  overrides?: UserOverride[];
}

interface UserStats {
  totalUsers: number;
  withOverrides: number;
  activeTrials: number;
  grandfathered: number;
  betaTesters: number;
  inOrganizations: number;
  withStripe: number;
  byTier: Record<string, number>;
}

interface FeatureDefinition {
  slug: string;
  name: string;
}

// Components
function TierBadge({ tier, status }: { tier: string; status?: string }) {
  const styles: Record<string, string> = {
    free: 'bg-gray-100 text-gray-700',
    pro: 'bg-blue-100 text-blue-700',
    enterprise: 'bg-purple-100 text-purple-700',
    admin: 'bg-amber-100 text-amber-700',
  };

  const icons: Record<string, React.ReactNode> = {
    free: <User className="w-3 h-3" />,
    pro: <Star className="w-3 h-3" />,
    enterprise: <Shield className="w-3 h-3" />,
    admin: <Shield className="w-3 h-3" />,
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
        ${styles[tier] || styles.free}
        ${status === 'cancelled' ? 'opacity-50 line-through' : ''}
      `}
    >
      {icons[tier]}
      {tier.charAt(0).toUpperCase() + tier.slice(1)}
    </span>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number | string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="bg-surface-container rounded-lg p-4">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-on-surface-variant" />}
        <div className="text-2xl font-semibold text-on-surface">{value}</div>
      </div>
      <div className="text-sm text-on-surface-variant">{label}</div>
    </div>
  );
}

function UserCard({
  user,
  features,
  onAddOverride,
  onRemoveOverride,
}: {
  user: UserData;
  features: FeatureDefinition[];
  onAddOverride: (userId: string, featureSlug: string) => void;
  onRemoveOverride: (userId: string, featureSlug: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAddOverride, setShowAddOverride] = useState(false);

  const overrides = user.overrides || [];

  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant">
      {/* User Header */}
      <div
        className="flex items-center gap-4 p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="w-5 h-5 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-on-surface truncate">
              {user.name}
            </span>
            <TierBadge tier={user.tier} status={user.tierStatus} />
            {user.trialActive && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Trial
              </span>
            )}
            {user.grandfathered && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Star className="w-3 h-3" />
                Grandfathered
              </span>
            )}
            {user.isBetaTester && (
              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Beaker className="w-3 h-3" />
                Beta
              </span>
            )}
            {user.organizationName && (
              <span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {user.organizationName}
              </span>
            )}
            {user.stripeCustomerId && (
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CreditCard className="w-3 h-3" />
                Stripe
              </span>
            )}
          </div>
          <span className="text-sm text-on-surface-variant">{user.email}</span>
        </div>

        <div className="flex items-center gap-4 text-sm text-on-surface-variant">
          <div className="text-center hidden md:block" title="Paywall hits">
            <div className="font-medium text-on-surface flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {user.paywallHits}
            </div>
          </div>
          <div className="text-center hidden md:block" title="Reports">
            <div className="font-medium text-on-surface flex items-center gap-1">
              <FileText className="w-3 h-3" />
              {user.reportsGenerated}
            </div>
          </div>
          <div className="text-center hidden md:block" title="Saved queries">
            <div className="font-medium text-on-surface flex items-center gap-1">
              <BarChart3 className="w-3 h-3" />
              {user.savedQueriesCount}
            </div>
          </div>
          <div className="text-center hidden md:block" title="Watchlist">
            <div className="font-medium text-on-surface flex items-center gap-1">
              <Bookmark className="w-3 h-3" />
              {user.watchlistCount}
            </div>
          </div>
          <div className="text-center hidden md:block" title="Alerts">
            <div className="font-medium text-on-surface flex items-center gap-1">
              <Bell className="w-3 h-3" />
              {user.alertsCount}
            </div>
          </div>
          <ChevronDown
            className={`w-5 h-5 transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-outline-variant p-4 space-y-4">
          {/* User Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
            <div>
              <div className="text-on-surface-variant">Member since</div>
              <div className="font-medium text-on-surface">
                {new Date(user.createdAt).toLocaleDateString()}
              </div>
            </div>
            <div>
              <div className="text-on-surface-variant">Last active</div>
              <div className="font-medium text-on-surface">
                {new Date(user.lastActive).toLocaleDateString()}
              </div>
            </div>
            {user.trialActive && user.trialExpiresAt && (
              <div>
                <div className="text-on-surface-variant">Trial expires</div>
                <div className="font-medium text-amber-600">
                  {new Date(user.trialExpiresAt).toLocaleDateString()}
                </div>
              </div>
            )}
            {user.organizationRole && (
              <div>
                <div className="text-on-surface-variant">Org role</div>
                <div className="font-medium text-on-surface capitalize">
                  {user.organizationRole}
                </div>
              </div>
            )}
            {user.grandfatheredType && (
              <div>
                <div className="text-on-surface-variant">Grandfather type</div>
                <div className="font-medium text-amber-600 capitalize">
                  {user.grandfatheredType}
                </div>
              </div>
            )}
            {user.stripeCustomerId && (
              <div>
                <div className="text-on-surface-variant">Stripe ID</div>
                <div className="font-medium text-on-surface font-mono text-xs">
                  {user.stripeCustomerId.slice(0, 12)}...
                </div>
              </div>
            )}
          </div>

          {/* Usage Stats */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            <div className="bg-surface-container-high rounded-lg p-2 text-center">
              <div className="text-lg font-semibold text-on-surface">{user.paywallHits}</div>
              <div className="text-xs text-on-surface-variant">Paywall</div>
            </div>
            <div className="bg-surface-container-high rounded-lg p-2 text-center">
              <div className="text-lg font-semibold text-on-surface">{user.reportsGenerated}</div>
              <div className="text-xs text-on-surface-variant">Reports</div>
            </div>
            <div className="bg-surface-container-high rounded-lg p-2 text-center">
              <div className="text-lg font-semibold text-on-surface">{user.savedQueriesCount}</div>
              <div className="text-xs text-on-surface-variant">Queries</div>
            </div>
            <div className="bg-surface-container-high rounded-lg p-2 text-center">
              <div className="text-lg font-semibold text-on-surface">{user.watchlistCount}</div>
              <div className="text-xs text-on-surface-variant">Watchlist</div>
            </div>
            <div className="bg-surface-container-high rounded-lg p-2 text-center">
              <div className="text-lg font-semibold text-on-surface">{user.alertsCount}</div>
              <div className="text-xs text-on-surface-variant">Alerts</div>
            </div>
            <div className="bg-surface-container-high rounded-lg p-2 text-center">
              <div className="text-lg font-semibold text-on-surface">{user.overrideCount}</div>
              <div className="text-xs text-on-surface-variant">Overrides</div>
            </div>
          </div>

          {/* Feature Overrides */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-on-surface">
                Feature Overrides
              </h4>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAddOverride(!showAddOverride);
                }}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Plus className="w-3 h-3" />
                Add Override
              </button>
            </div>

            {/* Add Override Form */}
            {showAddOverride && (
              <div className="bg-surface-container-high rounded-lg p-3 mb-3">
                <select
                  className="w-full px-3 py-2 bg-surface-container border border-outline-variant rounded-lg text-sm mb-2"
                  onChange={(e) => {
                    if (e.target.value) {
                      onAddOverride(user.id, e.target.value);
                      setShowAddOverride(false);
                    }
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select feature to override...
                  </option>
                  {features
                    .filter((f) => !overrides.some((o) => o.feature_slug === f.slug))
                    .map((feature) => (
                      <option key={feature.slug} value={feature.slug}>
                        {feature.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* Override List */}
            {overrides.length > 0 ? (
              <div className="space-y-2">
                {overrides.map((override) => (
                  <div
                    key={override.id}
                    className="flex items-center justify-between p-3 bg-surface-container-high rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`
                          w-6 h-6 rounded flex items-center justify-center
                          ${override.value
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                          }
                        `}
                      >
                        {override.value ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-on-surface">
                          {override.feature_name}
                        </div>
                        {override.reason && (
                          <div className="text-xs text-on-surface-variant">
                            {override.reason}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {override.expires_at && (
                        <div className="flex items-center gap-1 text-xs text-on-surface-variant">
                          <Clock className="w-3 h-3" />
                          Expires {new Date(override.expires_at).toLocaleDateString()}
                        </div>
                      )}
                      <button
                        onClick={() => onRemoveOverride(user.id, override.feature_slug)}
                        className="p-1.5 hover:bg-red-100 rounded text-on-surface-variant hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-on-surface-variant text-center py-4 bg-surface-container-high rounded-lg">
                No overrides configured
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 pt-2">
            <button className="flex-1 px-4 py-2 bg-surface-container-high text-on-surface rounded-lg text-sm hover:bg-surface-container transition-colors">
              Start Trial
            </button>
            <button className="flex-1 px-4 py-2 bg-surface-container-high text-on-surface rounded-lg text-sm hover:bg-surface-container transition-colors">
              Change Tier
            </button>
            <button className="flex-1 px-4 py-2 bg-surface-container-high text-on-surface rounded-lg text-sm hover:bg-surface-container transition-colors">
              View Activity
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function UserOverridesPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [features, setFeatures] = useState<FeatureDefinition[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (tierFilter) params.append('tier', tierFilter);

      const [usersRes, statsRes, featuresRes] = await Promise.all([
        fetchAPIRaw(`/api/admin/users?${params}`),
        fetchAPIRaw('/api/admin/users/stats'),
        fetchAPIRaw('/api/admin/features'),
      ]);

      if (usersRes.ok) {
        const usersResponse = await usersRes.json();
        const usersData = usersResponse.users || usersResponse.data || [];
        setTotal(usersResponse.total || usersData.length);
        if (Array.isArray(usersData)) {
          setUsers(usersData.map((u: Record<string, unknown>) => ({
            id: u.id as string,
            email: u.email as string || '',
            name: (u.name || u.full_name || 'Unknown') as string,
            tier: (u.tier || u.subscription_tier || 'free') as string,
            tierStatus: (u.tierStatus || u.tier_status || 'active') as string,
            createdAt: (u.createdAt || u.created_at) as string,
            lastActive: (u.lastActive || u.last_active || u.createdAt || u.created_at) as string,
            trialActive: (u.trialActive ?? u.trial_active ?? false) as boolean,
            trialExpiresAt: (u.trialExpiresAt || u.trial_expires_at) as string | undefined,
            trialTier: (u.trialTier || u.trial_tier) as string | undefined,
            grandfathered: (u.grandfathered ?? false) as boolean,
            grandfatheredType: (u.grandfatheredType || u.grandfathered_type) as string | undefined,
            grandfatheredReason: (u.grandfatheredReason || u.grandfathered_reason) as string | undefined,
            organizationId: (u.organizationId || u.organization_id) as string | undefined,
            organizationName: (u.organizationName || u.organization_name) as string | undefined,
            organizationRole: (u.organizationRole || u.organization_role) as string | undefined,
            stripeCustomerId: (u.stripeCustomerId || u.stripe_customer_id) as string | undefined,
            stripeSubscriptionId: (u.stripeSubscriptionId || u.stripe_subscription_id) as string | undefined,
            isBetaTester: (u.isBetaTester ?? u.is_beta_tester ?? false) as boolean,
            betaTesterId: (u.betaTesterId || u.beta_tester_id) as string | undefined,
            overrideCount: (u.overrideCount ?? u.override_count ?? 0) as number,
            paywallHits: (u.paywallHits ?? u.paywall_hits ?? 0) as number,
            reportsGenerated: (u.reportsGenerated ?? u.reports_generated ?? 0) as number,
            savedQueriesCount: (u.savedQueriesCount ?? u.saved_queries_count ?? 0) as number,
            watchlistCount: (u.watchlistCount ?? u.watchlist_count ?? 0) as number,
            alertsCount: (u.alertsCount ?? u.alerts_count ?? 0) as number,
            overrides: u.overrides as UserOverride[] | undefined,
          })));
        }
      }

      if (statsRes.ok) {
        const statsResponse = await statsRes.json();
        const statsData = statsResponse.data || statsResponse;
        setStats({
          totalUsers: statsData.totalUsers ?? statsData.total_users ?? 0,
          withOverrides: statsData.withOverrides ?? statsData.with_overrides ?? 0,
          activeTrials: statsData.activeTrials ?? statsData.active_trials ?? 0,
          grandfathered: statsData.grandfathered ?? 0,
          betaTesters: statsData.betaTesters ?? statsData.beta_testers ?? 0,
          inOrganizations: statsData.inOrganizations ?? statsData.in_organizations ?? 0,
          withStripe: statsData.withStripe ?? statsData.with_stripe ?? 0,
          byTier: statsData.byTier ?? statsData.by_tier ?? {},
        });
      }

      if (featuresRes.ok) {
        const featuresResponse = await featuresRes.json();
        const featuresData = featuresResponse.data || featuresResponse;
        if (Array.isArray(featuresData)) {
          setFeatures(featuresData.map((f: Record<string, unknown>) => ({
            slug: f.slug as string,
            name: f.name as string,
          })));
        }
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, tierFilter]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchData();
    }, 300);

    return () => clearTimeout(debounce);
  }, [fetchData]);

  const handleAddOverride = async (userId: string, featureSlug: string) => {
    try {
      const res = await fetchAPIRaw(`/api/admin/users/${userId}/overrides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featureSlug }),
      });

      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Failed to add override:', err);
    }
  };

  const handleRemoveOverride = async (userId: string, featureSlug: string) => {
    try {
      const res = await fetchAPIRaw(`/api/admin/users/${userId}/overrides/${featureSlug}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Failed to remove override:', err);
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-on-surface">User Management</h1>
          <p className="text-on-surface-variant">
            Manage users, feature overrides, and subscriptions
          </p>
        </div>
        <button
          onClick={fetchData}
          className="p-2 rounded-lg hover:bg-surface-container-high transition-colors"
          title="Refresh data"
        >
          <RefreshCw className={`w-4 h-4 text-on-surface-variant ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-container border border-outline-variant rounded-lg text-sm"
          />
        </div>
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="px-4 py-2 bg-surface-container border border-outline-variant rounded-lg text-sm"
        >
          <option value="">All Tiers</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
        <StatCard label="Total Users" value={stats?.totalUsers ?? 0} icon={User} />
        <StatCard label="With Overrides" value={stats?.withOverrides ?? 0} icon={Shield} />
        <StatCard label="Active Trials" value={stats?.activeTrials ?? 0} icon={Clock} />
        <StatCard label="Grandfathered" value={stats?.grandfathered ?? 0} icon={Star} />
        <StatCard label="Beta Testers" value={stats?.betaTesters ?? 0} icon={Beaker} />
        <StatCard label="In Orgs" value={stats?.inOrganizations ?? 0} icon={Building2} />
        <StatCard label="With Stripe" value={stats?.withStripe ?? 0} icon={CreditCard} />
        <StatCard
          label="Free/Pro/Ent"
          value={`${stats?.byTier?.free ?? 0}/${stats?.byTier?.pro ?? 0}/${stats?.byTier?.enterprise ?? 0}`}
          icon={BarChart3}
        />
      </div>

      {/* User List */}
      <div className="space-y-4">
        {users.map((user) => (
          <UserCard
            key={user.id}
            user={user}
            features={features}
            onAddOverride={handleAddOverride}
            onRemoveOverride={handleRemoveOverride}
          />
        ))}

        {users.length === 0 && !loading && (
          <div className="text-center py-12 bg-surface-container rounded-xl">
            <User className="w-12 h-12 text-on-surface-variant mx-auto mb-3" />
            <p className="text-on-surface-variant">No users found</p>
            <p className="text-sm text-on-surface-variant mt-1">
              Users will appear here when they sign up
            </p>
          </div>
        )}

        {total > users.length && (
          <div className="text-center text-sm text-on-surface-variant py-4">
            Showing {users.length} of {total} users
          </div>
        )}
      </div>
    </div>
  );
}
