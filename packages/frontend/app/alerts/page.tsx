'use client';

import { Bell, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import Link from 'next/link';
import { PageHeaderWithBreadcrumbs } from '@/components/navigation';
import { useAlerts, useAlertHistory } from '@/lib/alerts/hooks';
import { AlertFeed } from '@/components/alerts';
import { useEntitlements } from '@/lib/entitlements';

export default function AlertsPage() {
  const { alerts, isLoading, remove, update } = useAlerts();
  const { entries, unreadCount, isLoading: historyLoading, markRead } = useAlertHistory();
  const { tier } = useEntitlements();
  const isPaid = tier === 'pro' || tier === 'enterprise';

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <PageHeaderWithBreadcrumbs
          breadcrumbs={[{ label: 'Alerts' }]}
          title="Alerts"
          description={`Manage your market alerts${unreadCount > 0 ? ` \u2022 ${unreadCount} unread` : ''}`}
          icon={<Bell className="w-5 h-5" />}
        />

        {!isPaid && (
          <div className="mt-6 bg-primary/5 border border-primary/20 rounded-xl p-6 text-center">
            <Bell className="w-8 h-8 text-primary mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-on-surface mb-1">Pro Feature</h3>
            <p className="text-sm text-on-surface-variant mb-4">Set custom alerts on any market metric with a Pro subscription.</p>
            <Link href="/pricing" className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-on-primary rounded-full font-medium text-sm hover:bg-primary/90 transition-colors">
              Upgrade to Pro
            </Link>
          </div>
        )}

        {isPaid && (
          <>
            {/* Active Alerts */}
            <div className="mt-8">
              <h2 className="text-sm font-semibold text-on-surface mb-4">Active Alerts ({alerts.filter(a => a.is_active).length})</h2>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-surface-container-low animate-pulse" />)}
                </div>
              ) : alerts.length === 0 ? (
                <div className="text-center py-8 bg-surface-container-low rounded-xl border border-outline-variant">
                  <Bell className="w-8 h-8 text-on-surface-variant/30 mx-auto mb-3" />
                  <p className="text-sm text-on-surface-variant">No alerts set up yet</p>
                  <p className="text-xs text-on-surface-variant mt-1">Use the bell icon on metric cards to create alerts.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.map(alert => (
                    <div key={alert.id} className="bg-surface-container-low rounded-xl border border-outline-variant p-4 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-on-surface">{alert.geography_name}</p>
                        <p className="text-xs text-on-surface-variant">
                          {alert.metric_id} {alert.condition} {alert.threshold}
                        </p>
                      </div>
                      <button
                        onClick={() => update(alert.id, { is_active: !alert.is_active })}
                        className="p-1.5 rounded-lg hover:bg-surface-container-high transition-colors"
                        title={alert.is_active ? 'Disable' : 'Enable'}
                      >
                        {alert.is_active ? (
                          <ToggleRight className="w-5 h-5 text-primary" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-on-surface-variant" />
                        )}
                      </button>
                      <button
                        onClick={() => remove(alert.id)}
                        className="p-1.5 rounded-lg hover:bg-error/10 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-error" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Alert History */}
            <div className="mt-8">
              <h2 className="text-sm font-semibold text-on-surface mb-4">Recent History</h2>
              <AlertFeed entries={entries} isLoading={historyLoading} onMarkRead={markRead} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
