'use client';

import React, { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import { fetchAPIRaw } from '@/lib/data';
import { WidgetShell } from './WidgetShell';

interface UsersBillingStats {
  totalUsers: number;
  activeTrials: number;
  expiringSoon: number;
  paywallViews: number;
  conversions: number;
}

interface UsersBillingWidgetProps {
  refreshTrigger: number;
}

export function UsersBillingWidget({ refreshTrigger }: UsersBillingWidgetProps) {
  const [data, setData] = useState<UsersBillingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [analyticsRes, trialRes, userRes] = await Promise.all([
          fetchAPIRaw('/api/admin/analytics/paywall?days=30'),
          fetchAPIRaw('/api/admin/trial/stats'),
          fetchAPIRaw('/api/admin/users/stats'),
        ]);

        let paywallViews = 0;
        let conversions = 0;
        if (analyticsRes.ok) {
          const raw = await analyticsRes.json();
          const d = raw.data || raw;
          paywallViews = d.paywall_views ?? d.paywallViews ?? 0;
          conversions = d.conversions ?? 0;
        }

        let activeTrials = 0;
        let expiringSoon = 0;
        if (trialRes.ok) {
          const raw = await trialRes.json();
          const d = raw.data || raw;
          activeTrials = d.active_count ?? d.activeCount ?? 0;
          expiringSoon = d.expiring_soon_count ?? d.expiringSoonCount ?? 0;
        }

        let totalUsers = 0;
        if (userRes.ok) {
          const raw = await userRes.json();
          const d = raw.data || raw;
          totalUsers = d.total_users ?? d.totalUsers ?? 0;
        }

        if (!cancelled) {
          setData({ totalUsers, activeTrials, expiringSoon, paywallViews, conversions });
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [refreshTrigger]);

  return (
    <WidgetShell
      title="Users & Billing"
      icon={Users}
      href="/admin/entitlements"
      loading={loading}
      error={error}
    >
      {data ? (
        <div className="space-y-3">
          {/* Hero stat: Total Users */}
          <div className="text-center">
            <div className="text-2xl font-semibold text-on-surface">
              {data.totalUsers.toLocaleString()}
            </div>
            <div className="text-xs text-on-surface-variant mt-0.5">Total Users</div>
          </div>

          {/* Secondary stats grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center">
              <div className="text-lg font-semibold text-on-surface">
                {data.activeTrials.toLocaleString()}
              </div>
              <div className="text-xs text-on-surface-variant">Active Trials</div>
            </div>
            <div className="text-center">
              <div className={`text-lg font-semibold ${data.expiringSoon > 0 ? 'text-amber-600' : 'text-on-surface'}`}>
                {data.expiringSoon.toLocaleString()}
              </div>
              <div className="text-xs text-on-surface-variant">Expiring Soon</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-on-surface">
                {data.paywallViews.toLocaleString()}
              </div>
              <div className="text-xs text-on-surface-variant">Paywall Views</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-on-surface">
                {data.conversions.toLocaleString()}
              </div>
              <div className="text-xs text-on-surface-variant">Conversions</div>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-on-surface-variant">Unable to load user stats</p>
      )}
    </WidgetShell>
  );
}
