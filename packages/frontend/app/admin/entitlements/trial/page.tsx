'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Users,
  TrendingUp,
  Bell,
  Save,
  ToggleLeft,
  ToggleRight,
  Calendar,
  Gift,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { fetchAPIRaw } from '@/lib/data';

// Types
interface TrialConfig {
  isEnabled: boolean;
  durationDays: number;
  trialTier: string;
  showBanner: boolean;
  autoConvertEnabled: boolean;
  reminderDays: number[];
}

interface TrialStats {
  activeCount: number;
  expiringSoonCount: number;
  conversionRate: number;
  avgUsage: number;
}

interface ActiveTrial {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  tier: string;
  startedAt: string;
  expiresAt: string;
  daysRemaining: number;
  paywallHits: number;
}

const DEFAULT_CONFIG: TrialConfig = {
  isEnabled: false,
  durationDays: 14,
  trialTier: 'pro',
  showBanner: true,
  autoConvertEnabled: false,
  reminderDays: [7, 3, 1],
};

// Components
function ToggleSwitch({
  enabled,
  onChange,
  label,
  description,
}: {
  enabled: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-sm font-medium text-on-surface">{label}</div>
        {description && (
          <div className="text-xs text-on-surface-variant mt-0.5">
            {description}
          </div>
        )}
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className="flex-shrink-0"
        aria-label={`Toggle ${label}`}
      >
        {enabled ? (
          <ToggleRight className="w-10 h-6 text-primary" />
        ) : (
          <ToggleLeft className="w-10 h-6 text-on-surface-variant" />
        )}
      </button>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
}) {
  return (
    <div className="bg-surface-container rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        {trend && (
          <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
            {trend}
          </span>
        )}
      </div>
      <div className="text-2xl font-semibold text-on-surface">{value}</div>
      <div className="text-sm text-on-surface-variant">{label}</div>
    </div>
  );
}

function TrialStatusBadge({ daysRemaining }: { daysRemaining: number }) {
  if (daysRemaining <= 1) {
    return (
      <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
        <AlertCircle className="w-3 h-3" />
        Expiring
      </span>
    );
  }
  if (daysRemaining <= 3) {
    return (
      <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
        <Clock className="w-3 h-3" />
        {daysRemaining} days left
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
      <CheckCircle className="w-3 h-3" />
      {daysRemaining} days left
    </span>
  );
}

export default function TrialSettingsPage() {
  const [config, setConfig] = useState<TrialConfig>(DEFAULT_CONFIG);
  const [stats, setStats] = useState<TrialStats | null>(null);
  const [activeTrials, setActiveTrials] = useState<ActiveTrial[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [configRes, statsRes, trialsRes] = await Promise.all([
        fetchAPIRaw('/api/admin/trial/config'),
        fetchAPIRaw('/api/admin/trial/stats'),
        fetchAPIRaw('/api/admin/trial/users'),
      ]);

      if (configRes.ok) {
        const configResponse = await configRes.json();
        const configData = configResponse.data || configResponse;
        setConfig({
          isEnabled: configData.is_enabled ?? false,
          durationDays: configData.duration_days ?? 14,
          trialTier: configData.trial_tier ?? 'pro',
          showBanner: configData.show_banner ?? true,
          autoConvertEnabled: configData.auto_convert_enabled ?? false,
          reminderDays: configData.reminder_days ?? [7, 3, 1],
        });
      }

      if (statsRes.ok) {
        const statsResponse = await statsRes.json();
        const statsData = statsResponse.data || statsResponse;
        setStats({
          activeCount: statsData.active_count ?? 0,
          expiringSoonCount: statsData.expiring_soon_count ?? 0,
          conversionRate: statsData.conversion_rate ?? 0,
          avgUsage: statsData.avg_usage ?? 0,
        });
      }

      if (trialsRes.ok) {
        const trialsResponse = await trialsRes.json();
        const trialsData = trialsResponse.data || [];
        // Map snake_case API response to camelCase interface
        setActiveTrials(trialsData.map((t: Record<string, unknown>) => ({
          id: t.id,
          userId: t.user_id,
          userName: t.user_name || 'Unknown',
          userEmail: t.user_email || '',
          tier: t.tier || 'pro',
          startedAt: t.started_at,
          expiresAt: t.expires_at,
          daysRemaining: t.days_remaining ?? 0,
          paywallHits: t.paywall_hits ?? 0,
        })));
      }
    } catch (err) {
      console.error('Failed to fetch trial data:', err);
      setError('Failed to load trial data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateConfig = (updates: Partial<TrialConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetchAPIRaw('/api/admin/trial/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_enabled: config.isEnabled,
          duration_days: config.durationDays,
          trial_tier: config.trialTier,
          show_banner: config.showBanner,
          auto_convert_enabled: config.autoConvertEnabled,
          reminder_days: config.reminderDays,
        }),
      });

      if (!res.ok) throw new Error('Failed to save');
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to save trial config:', err);
      setError('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleExtendTrial = async (userId: string) => {
    try {
      const res = await fetchAPIRaw(`/api/admin/trial/users/${userId}/extend`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 7 }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Failed to extend trial:', err);
    }
  };

  const handleCancelTrial = async (userId: string) => {
    try {
      const res = await fetchAPIRaw(`/api/admin/trial/users/${userId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Failed to cancel trial:', err);
    }
  };

  const expiringCount = activeTrials.filter((t) => t.daysRemaining <= 3).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-700 hover:text-red-900">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-on-surface">Trial Settings</h1>
          <p className="text-on-surface-variant">
            Configure trial periods and manage active trials
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="p-2 rounded-lg hover:bg-surface-container-high transition-colors"
            title="Refresh data"
          >
            <RefreshCw className="w-4 h-4 text-on-surface-variant" />
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg transition-colors
              ${hasChanges && !saving
                ? 'bg-primary text-on-primary hover:bg-primary/90'
                : 'bg-surface-container-high text-on-surface-variant cursor-not-allowed'
              }
            `}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Active Trials"
          value={stats?.activeCount ?? activeTrials.length}
          icon={Users}
        />
        <StatCard
          label="Expiring Soon"
          value={stats?.expiringSoonCount ?? expiringCount}
          icon={AlertCircle}
        />
        <StatCard
          label="Conversion Rate"
          value={stats?.conversionRate != null ? `${stats.conversionRate}%` : '-'}
          icon={TrendingUp}
          trend={stats?.conversionRate != null && stats.conversionRate > 20 ? '+5%' : undefined}
        />
        <StatCard
          label="Avg Trial Usage"
          value={stats?.avgUsage != null ? `${stats.avgUsage}%` : '-'}
          icon={Clock}
        />
      </div>

      {/* Configuration */}
      <div className="bg-surface-container rounded-xl p-6 mb-8">
        <h2 className="text-lg font-medium text-on-surface mb-6">
          Trial Configuration
        </h2>

        <div className="space-y-6">
          {/* Master Toggle */}
          <div className="pb-6 border-b border-outline-variant">
            <ToggleSwitch
              enabled={config.isEnabled}
              onChange={(value) => updateConfig({ isEnabled: value })}
              label="Enable Trial Sign-ups"
              description="Allow new users to start a free trial"
            />
          </div>

          {/* Duration */}
          <div className="flex items-center justify-between gap-4 pb-6 border-b border-outline-variant">
            <div>
              <div className="text-sm font-medium text-on-surface">
                Trial Duration
              </div>
              <div className="text-xs text-on-surface-variant mt-0.5">
                How long users can try premium features
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={config.durationDays}
                onChange={(e) =>
                  updateConfig({ durationDays: parseInt(e.target.value) || 14 })
                }
                min={1}
                max={90}
                className="w-20 px-3 py-2 bg-surface-container border border-outline-variant rounded-lg text-sm text-center"
              />
              <span className="text-sm text-on-surface-variant">days</span>
            </div>
          </div>

          {/* Trial Tier */}
          <div className="flex items-center justify-between gap-4 pb-6 border-b border-outline-variant">
            <div>
              <div className="text-sm font-medium text-on-surface">
                Trial Tier
              </div>
              <div className="text-xs text-on-surface-variant mt-0.5">
                Which tier users get during trial
              </div>
            </div>
            <select
              value={config.trialTier}
              onChange={(e) => updateConfig({ trialTier: e.target.value })}
              className="px-3 py-2 bg-surface-container border border-outline-variant rounded-lg text-sm"
            >
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>

          {/* Show Banner */}
          <div className="pb-6 border-b border-outline-variant">
            <ToggleSwitch
              enabled={config.showBanner}
              onChange={(value) => updateConfig({ showBanner: value })}
              label="Show Trial Banner"
              description="Display a banner showing trial status and days remaining"
            />
          </div>

          {/* Reminder Emails */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-on-surface">
                Reminder Emails
              </div>
              <div className="text-xs text-on-surface-variant mt-0.5">
                Send reminders before trial expires
              </div>
            </div>
            <div className="flex items-center gap-2">
              {[7, 3, 1].map((day) => (
                <button
                  key={day}
                  onClick={() => {
                    const newDays = config.reminderDays.includes(day)
                      ? config.reminderDays.filter((d) => d !== day)
                      : [...config.reminderDays, day].sort((a, b) => b - a);
                    updateConfig({ reminderDays: newDays });
                  }}
                  className={`
                    px-3 py-1.5 rounded-lg text-sm transition-colors
                    ${config.reminderDays.includes(day)
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container-high text-on-surface-variant'
                    }
                  `}
                >
                  {day}d
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Active Trials */}
      <div className="bg-surface-container rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium text-on-surface">Active Trials</h2>
          <button className="text-sm text-primary hover:underline">
            View all
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-outline-variant">
                <th className="pb-3 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                  User
                </th>
                <th className="pb-3 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                  Status
                </th>
                <th className="pb-3 text-xs font-medium text-on-surface-variant uppercase tracking-wider text-center">
                  Tier
                </th>
                <th className="pb-3 text-xs font-medium text-on-surface-variant uppercase tracking-wider text-right">
                  Usage
                </th>
                <th className="pb-3 text-xs font-medium text-on-surface-variant uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {activeTrials.map((trial) => (
                <tr
                  key={trial.id}
                  className="border-b border-outline-variant last:border-0"
                >
                  <td className="py-3">
                    <div>
                      <div className="text-sm font-medium text-on-surface">
                        {trial.userName}
                      </div>
                      <div className="text-xs text-on-surface-variant">
                        {trial.userEmail}
                      </div>
                    </div>
                  </td>
                  <td className="py-3">
                    <TrialStatusBadge daysRemaining={trial.daysRemaining} />
                  </td>
                  <td className="py-3 text-center">
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      {trial.tier}
                    </span>
                  </td>
                  <td className="py-3 text-right text-sm text-on-surface-variant">
                    {trial.paywallHits} features used
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleExtendTrial(trial.userId)}
                        className="text-xs text-primary hover:underline"
                      >
                        Extend
                      </button>
                      <button
                        onClick={() => handleCancelTrial(trial.userId)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {activeTrials.length === 0 && (
          <div className="text-center py-8">
            <Gift className="w-12 h-12 text-on-surface-variant mx-auto mb-3" />
            <p className="text-on-surface-variant">No active trials</p>
          </div>
        )}
      </div>

      {/* Trial Tips */}
      <div className="mt-8 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
        <h3 className="text-lg font-medium text-blue-900 mb-3">
          Trial Best Practices
        </h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <span>
              14-day trials have 30% higher conversion than 7-day trials
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <span>
              Users who use 3+ premium features are 5x more likely to convert
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <span>
              Email reminders at 7, 3, and 1 day increase conversions by 15%
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
