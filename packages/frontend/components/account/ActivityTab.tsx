'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Mail, TrendingUp, Megaphone, Loader2, Lock } from 'lucide-react';
import { useEntitlements } from '@/lib/entitlements';
import type { UserTier } from '@/lib/entitlements';
import { useWatchlist } from '@/components/analytics-assistant/persistence/useWatchlist';
import { useAlerts, useAlertHistory } from '@/lib/alerts/hooks';
import { WatchlistDashboard } from '@/components/watchlist';
import { AlertFeed } from '@/components/alerts';
import { fetchEmailPreferences, updateEmailPreferences } from '@/lib/data';
import type { EmailPreferences } from '@/lib/data';
import type { User } from '@supabase/supabase-js';

// --- Watchlist limits (mirrors SubscriptionTab) --------------------------------

const WATCHLIST_LIMITS: Record<UserTier, number> = {
  free: 3,
  pro: 10,
  enterprise: 25,
  admin: -1,
};

// --- Main component -----------------------------------------------------------

interface ActivityTabProps {
  user: User;
}

export function ActivityTab({ user }: ActivityTabProps) {
  const { tier } = useEntitlements();
  const { items: watchlistItems, isLoading: watchlistLoading } = useWatchlist({
    userId: user.id,
    autoLoad: true,
  });
  const { alerts } = useAlerts();
  const { entries: alertEntries, isLoading: alertsLoading, markRead } = useAlertHistory();

  const watchlistLimit = WATCHLIST_LIMITS[tier];

  return (
    <div className="py-8 space-y-0">
      {/* Saved Markets */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-semibold text-on-surface">Favorites</h3>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-on-surface/10 text-on-surface-variant">
            {watchlistItems.length}
            {watchlistLimit !== -1 ? ` of ${watchlistLimit}` : ''}
          </span>
        </div>
        <WatchlistDashboard items={watchlistItems} isLoading={watchlistLoading} />
      </section>

      <div className="border-t border-outline-variant my-8" />

      {/* Alerts */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-on-surface">Alerts</h3>
            {tier !== 'free' && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-on-surface/10 text-on-surface-variant">
                {alerts.length}
              </span>
            )}
          </div>
          {tier !== 'free' && (
            <Link
              href="/alerts"
              className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Manage Alerts
            </Link>
          )}
        </div>

        {tier === 'free' ? (
          <div className="rounded-xl border border-outline-variant bg-surface-container-low p-6 text-center">
            <Lock className="w-8 h-8 text-on-surface-variant/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-on-surface">
              Alerts are a Pro feature
            </p>
            <p className="text-xs text-on-surface-variant mt-1 mb-3">
              Get notified when market conditions change in the areas you care about.
            </p>
            <Link
              href="/pricing"
              className="inline-flex px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Upgrade to Pro
            </Link>
          </div>
        ) : (
          <AlertFeed
            entries={alertEntries}
            isLoading={alertsLoading}
            onMarkRead={markRead}
          />
        )}
      </section>

      <div className="border-t border-outline-variant my-8" />

      {/* Notification Preferences */}
      <NotificationPreferences />
    </div>
  );
}

// --- Notification Preferences -------------------------------------------------

const PREF_TOGGLES: {
  key: keyof EmailPreferences;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    key: 'weekly_digest',
    label: 'Weekly Digest',
    description: 'Summary of your saved markets every Monday',
    icon: <Mail className="w-4 h-4" />,
  },
  {
    key: 'alert_emails',
    label: 'Alert Notifications',
    description: 'Get notified when alerts trigger',
    icon: <TrendingUp className="w-4 h-4" />,
  },
  {
    key: 'marketing',
    label: 'Product Updates',
    description: 'Occasional updates about new features',
    icon: <Megaphone className="w-4 h-4" />,
  },
];

function NotificationPreferences() {
  const [prefs, setPrefs] = useState<EmailPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchEmailPreferences()
      .then((data) => {
        if (!cancelled) {
          setPrefs(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          // Default to all-off on error
          setPrefs({ weekly_digest: false, alert_emails: false, marketing: false });
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  const handleToggle = useCallback(
    async (key: keyof EmailPreferences) => {
      if (!prefs) return;
      const newValue = !prefs[key];
      setSavingKey(key);
      setPrefs((prev) => (prev ? { ...prev, [key]: newValue } : prev));

      try {
        await updateEmailPreferences({ [key]: newValue });
      } catch {
        // Revert on failure
        setPrefs((prev) => (prev ? { ...prev, [key]: !newValue } : prev));
      } finally {
        setSavingKey(null);
      }
    },
    [prefs]
  );

  return (
    <section>
      <h3 className="text-sm font-semibold text-on-surface mb-4">Email Notifications</h3>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-on-surface-variant" />
        </div>
      ) : (
        <div className="space-y-3">
          {PREF_TOGGLES.map((toggle) => {
            const checked = prefs?.[toggle.key] ?? false;
            const isSaving = savingKey === toggle.key;

            return (
              <div
                key={toggle.key}
                className="flex items-center justify-between p-4 rounded-xl bg-surface-container-low border border-outline-variant"
              >
                <div className="flex items-center gap-3">
                  <div className="text-on-surface-variant">{toggle.icon}</div>
                  <div>
                    <p className="text-sm font-medium text-on-surface">{toggle.label}</p>
                    <p className="text-xs text-on-surface-variant">{toggle.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isSaving && (
                    <span className="text-xs text-on-surface-variant">Saving...</span>
                  )}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={checked}
                    onClick={() => handleToggle(toggle.key)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                      checked ? 'bg-primary' : 'bg-on-surface/20'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        checked ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
