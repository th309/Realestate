"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Clock,
  Users,
  TrendingUp,
  Calendar,
  AlertCircle,
  XCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { fetchAPIRaw } from "@/lib/data";
import { ToggleSwitch } from "./components/ToggleSwitch";
import { StatCard } from "./components/StatCard";
import { TrialsTable, type ActiveTrial } from "./components/TrialsTable";

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
  avgSessions: number;
}

const DEFAULT_CONFIG: TrialConfig = {
  isEnabled: false,
  durationDays: 14,
  trialTier: "pro",
  showBanner: true,
  autoConvertEnabled: false,
  reminderDays: [7, 3, 1],
};

export default function TrialSettingsPage() {
  const [config, setConfig] = useState<TrialConfig>(DEFAULT_CONFIG);
  const [stats, setStats] = useState<TrialStats | null>(null);
  const [trials, setTrials] = useState<ActiveTrial[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [configRes, statsRes, trialsRes] = await Promise.all([
        fetchAPIRaw("/api/admin/trial/config"),
        fetchAPIRaw("/api/admin/trial/stats"),
        fetchAPIRaw("/api/admin/trial/users"),
      ]);

      const failures: string[] = [];

      if (configRes.ok) {
        const configResponse = await configRes.json();
        const configData = configResponse.data || configResponse;
        setConfig({
          isEnabled: configData.is_enabled ?? false,
          durationDays: configData.duration_days ?? 14,
          trialTier: configData.trial_tier ?? "pro",
          showBanner: configData.show_banner ?? true,
          autoConvertEnabled: configData.auto_convert_enabled ?? false,
          reminderDays: configData.reminder_days ?? [7, 3, 1],
        });
      } else {
        failures.push(`config (${configRes.status})`);
      }

      if (statsRes.ok) {
        const statsResponse = await statsRes.json();
        const statsData = statsResponse.data || statsResponse;
        setStats({
          activeCount: statsData.active_count ?? 0,
          expiringSoonCount: statsData.expiring_soon_count ?? 0,
          conversionRate: statsData.conversion_rate ?? 0,
          avgSessions: statsData.avg_sessions ?? 0,
        });
      } else {
        failures.push(`stats (${statsRes.status})`);
      }

      if (trialsRes.ok) {
        const trialsResponse = await trialsRes.json();
        const trialsData = trialsResponse.data || [];
        setTrials(
          trialsData.map((t: Record<string, unknown>) => ({
            id: t.id,
            userId: t.user_id,
            userName: t.user_name || "Unknown",
            userEmail: t.user_email || "",
            tier: t.tier || "pro",
            startedAt: t.started_at,
            expiresAt: t.expires_at,
            daysRemaining: t.days_remaining ?? 0,
            convertedAt: (t.converted_at as string | null) ?? null,
            cancelledAt: (t.cancelled_at as string | null) ?? null,
            paywallHits: t.paywall_hits ?? 0,
            reasonCode: (t.reason_code as string | null) ?? null,
            reasonLabel: (t.reason_label as string | null) ?? null,
            detail: (t.detail as string | null) ?? null,
          })),
        );
      } else {
        failures.push(`trials (${trialsRes.status})`);
      }

      if (failures.length) {
        setError(`Failed to load: ${failures.join(", ")}`);
      }
    } catch (err) {
      console.error("Failed to fetch trial data:", err);
      setError("Failed to load trial data");
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
      const res = await fetchAPIRaw("/api/admin/trial/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_enabled: config.isEnabled,
          duration_days: config.durationDays,
          trial_tier: config.trialTier,
          show_banner: config.showBanner,
          auto_convert_enabled: config.autoConvertEnabled,
          reminder_days: config.reminderDays,
        }),
      });

      if (!res.ok) throw new Error("Failed to save");
      setHasChanges(false);
    } catch (err) {
      console.error("Failed to save trial config:", err);
      setError("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleExtendTrial = async (userId: string) => {
    try {
      const res = await fetchAPIRaw(`/api/admin/trial/users/${userId}/extend`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 7 }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error("Failed to extend trial:", err);
    }
  };

  const handleCancelTrial = async (userId: string) => {
    try {
      const res = await fetchAPIRaw(`/api/admin/trial/users/${userId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error("Failed to cancel trial:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-700 hover:text-red-900"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-on-surface">
            Trial Settings
          </h1>
          <p className="text-on-surface-variant">
            Configure trial periods and manage trials
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
              ${
                hasChanges && !saving
                  ? "bg-primary text-on-primary hover:bg-primary/90"
                  : "bg-surface-container-high text-on-surface-variant cursor-not-allowed"
              }
            `}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Calendar className="w-4 h-4" />
            )}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Active Trials"
          value={stats?.activeCount ?? trials.length}
          icon={Users}
        />
        <StatCard
          label="Expiring Soon"
          value={stats?.expiringSoonCount ?? 0}
          icon={AlertCircle}
        />
        <StatCard
          label="Conversion Rate"
          value={
            stats?.conversionRate != null ? `${stats.conversionRate}%` : "-"
          }
          icon={TrendingUp}
        />
        <StatCard
          label="Avg Sessions"
          value={stats?.avgSessions ?? "-"}
          icon={Clock}
        />
      </div>

      <div className="bg-surface-container rounded-xl p-6 mb-8">
        <h2 className="text-lg font-medium text-on-surface mb-6">
          Trial Configuration
        </h2>

        <div className="space-y-6">
          <div className="pb-6 border-b border-outline-variant">
            <ToggleSwitch
              enabled={config.isEnabled}
              onChange={(value) => updateConfig({ isEnabled: value })}
              label="Enable Trial Sign-ups"
              description="Allow new users to start a free trial"
            />
          </div>

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

          <div className="pb-6 border-b border-outline-variant">
            <ToggleSwitch
              enabled={config.showBanner}
              onChange={(value) => updateConfig({ showBanner: value })}
              label="Show Trial Banner"
              description="Display a banner showing trial status and days remaining"
            />
          </div>

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
                    ${
                      config.reminderDays.includes(day)
                        ? "bg-primary text-on-primary"
                        : "bg-surface-container-high text-on-surface-variant"
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

      <div className="bg-surface-container rounded-xl p-6">
        <h2 className="text-lg font-medium text-on-surface mb-6">Trials</h2>
        <TrialsTable
          trials={trials}
          onExtend={handleExtendTrial}
          onCancel={handleCancelTrial}
        />
      </div>
    </div>
  );
}
