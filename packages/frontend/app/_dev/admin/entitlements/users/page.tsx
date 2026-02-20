'use client';

import React, { useState } from 'react';
import {
  Search,
  User,
  Home,
  Warehouse,
  Building2,
  Shield,
  Plus,
  Trash2,
  Check,
  X,
  ChevronDown,
  Calendar,
  Clock,
} from 'lucide-react';

// Types
interface UserOverride {
  id: string;
  featureSlug: string;
  featureName: string;
  value: boolean | number;
  reason?: string;
  createdAt: string;
  expiresAt?: string;
}

interface UserData {
  id: string;
  email: string;
  name: string;
  tier: string;
  createdAt: string;
  trialActive: boolean;
  trialExpiresAt?: string;
  overrides: UserOverride[];
  paywallHits: number;
  lastActive: string;
}

// Mock data
const MOCK_USERS: UserData[] = [
  {
    id: '1',
    email: 'john@example.com',
    name: 'John Smith',
    tier: 'free',
    createdAt: '2025-12-01',
    trialActive: false,
    overrides: [
      {
        id: 'o1',
        featureSlug: 'metric_rental_yield',
        featureName: 'Rental Yield Metric',
        value: true,
        reason: 'Beta tester',
        createdAt: '2026-01-15',
        expiresAt: '2026-03-15',
      },
    ],
    paywallHits: 47,
    lastActive: '2026-02-07',
  },
  {
    id: '2',
    email: 'sarah@realestate.co',
    name: 'Sarah Johnson',
    tier: 'pro',
    createdAt: '2025-10-15',
    trialActive: false,
    overrides: [],
    paywallHits: 12,
    lastActive: '2026-02-06',
  },
  {
    id: '3',
    email: 'mike@investor.com',
    name: 'Mike Chen',
    tier: 'free',
    createdAt: '2026-01-20',
    trialActive: true,
    trialExpiresAt: '2026-02-14',
    overrides: [],
    paywallHits: 89,
    lastActive: '2026-02-07',
  },
];

const AVAILABLE_FEATURES = [
  { slug: 'metric_rental_yield', name: 'Rental Yield Metric' },
  { slug: 'metric_cap_rate', name: 'Cap Rate Metric' },
  { slug: 'metric_forecast', name: 'Forecast Metrics' },
  { slug: 'geo_county', name: 'County Level Access' },
  { slug: 'geo_zip', name: 'ZIP Code Level Access' },
  { slug: 'geo_tract', name: 'Census Tract Access' },
  { slug: 'feature_export_csv', name: 'CSV Export' },
  { slug: 'feature_ai_insights', name: 'AI Insights' },
];

// Components
function TierBadge({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    free: 'bg-gray-100 text-gray-700',
    pro: 'bg-blue-100 text-blue-700',
    enterprise: 'bg-purple-100 text-purple-700',
    admin: 'bg-amber-100 text-amber-700',
  };

  const icons: Record<string, React.ReactNode> = {
    free: <Home className="w-3 h-3" />,
    pro: <Warehouse className="w-3 h-3" />,
    enterprise: <Building2 className="w-3 h-3" />,
    admin: <Shield className="w-3 h-3" />,
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
        ${styles[tier] || styles.free}
      `}
    >
      {icons[tier]}
      {tier.charAt(0).toUpperCase() + tier.slice(1)}
    </span>
  );
}

function UserCard({
  user,
  onAddOverride,
  onRemoveOverride,
}: {
  user: UserData;
  onAddOverride: (userId: string, featureSlug: string) => void;
  onRemoveOverride: (userId: string, overrideId: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAddOverride, setShowAddOverride] = useState(false);

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
          <div className="flex items-center gap-2">
            <span className="font-medium text-on-surface truncate">
              {user.name}
            </span>
            <TierBadge tier={user.tier} />
            {user.trialActive && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                Trial
              </span>
            )}
          </div>
          <span className="text-sm text-on-surface-variant">{user.email}</span>
        </div>

        <div className="flex items-center gap-6 text-sm text-on-surface-variant">
          <div className="text-center">
            <div className="font-medium text-on-surface">{user.paywallHits}</div>
            <div className="text-xs">Paywall hits</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-on-surface">
              {user.overrides.length}
            </div>
            <div className="text-xs">Overrides</div>
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
          {/* User Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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
                  {AVAILABLE_FEATURES.filter(
                    (f) => !user.overrides.some((o) => o.featureSlug === f.slug)
                  ).map((feature) => (
                    <option key={feature.slug} value={feature.slug}>
                      {feature.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Override List */}
            {user.overrides.length > 0 ? (
              <div className="space-y-2">
                {user.overrides.map((override) => (
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
                          {override.featureName}
                        </div>
                        {override.reason && (
                          <div className="text-xs text-on-surface-variant">
                            {override.reason}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {override.expiresAt && (
                        <div className="flex items-center gap-1 text-xs text-on-surface-variant">
                          <Clock className="w-3 h-3" />
                          Expires {new Date(override.expiresAt).toLocaleDateString()}
                        </div>
                      )}
                      <button
                        onClick={() => onRemoveOverride(user.id, override.id)}
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
  const [users, setUsers] = useState<UserData[]>(MOCK_USERS);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('');

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTier = !tierFilter || user.tier === tierFilter;
    return matchesSearch && matchesTier;
  });

  const handleAddOverride = (userId: string, featureSlug: string) => {
    const feature = AVAILABLE_FEATURES.find((f) => f.slug === featureSlug);
    if (!feature) return;

    setUsers((prev) =>
      prev.map((user) => {
        if (user.id !== userId) return user;
        return {
          ...user,
          overrides: [
            ...user.overrides,
            {
              id: `o${Date.now()}`,
              featureSlug: feature.slug,
              featureName: feature.name,
              value: true,
              createdAt: new Date().toISOString(),
            },
          ],
        };
      })
    );
  };

  const handleRemoveOverride = (userId: string, overrideId: string) => {
    setUsers((prev) =>
      prev.map((user) => {
        if (user.id !== userId) return user;
        return {
          ...user,
          overrides: user.overrides.filter((o) => o.id !== overrideId),
        };
      })
    );
  };

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-on-surface">User Overrides</h1>
        <p className="text-on-surface-variant">
          Manage per-user feature access and tier overrides
        </p>
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
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-surface-container rounded-lg p-4">
          <div className="text-2xl font-semibold text-on-surface">
            {users.length}
          </div>
          <div className="text-sm text-on-surface-variant">Total Users</div>
        </div>
        <div className="bg-surface-container rounded-lg p-4">
          <div className="text-2xl font-semibold text-on-surface">
            {users.filter((u) => u.overrides.length > 0).length}
          </div>
          <div className="text-sm text-on-surface-variant">With Overrides</div>
        </div>
        <div className="bg-surface-container rounded-lg p-4">
          <div className="text-2xl font-semibold text-on-surface">
            {users.filter((u) => u.trialActive).length}
          </div>
          <div className="text-sm text-on-surface-variant">Active Trials</div>
        </div>
      </div>

      {/* User List */}
      <div className="space-y-4">
        {filteredUsers.map((user) => (
          <UserCard
            key={user.id}
            user={user}
            onAddOverride={handleAddOverride}
            onRemoveOverride={handleRemoveOverride}
          />
        ))}

        {filteredUsers.length === 0 && (
          <div className="text-center py-12 bg-surface-container rounded-xl">
            <User className="w-12 h-12 text-on-surface-variant mx-auto mb-3" />
            <p className="text-on-surface-variant">No users found</p>
          </div>
        )}
      </div>
    </div>
  );
}
