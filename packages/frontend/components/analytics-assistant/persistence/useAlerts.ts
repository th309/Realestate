'use client';

/**
 * useAlerts Hook
 *
 * Manages user alerts for price/score changes.
 */

import { useState, useCallback, useEffect } from 'react';

export interface AlertCondition {
  geography_type: string;
  geography_id: string;
  geography_name?: string;
  metric: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'change_pct';
  value: number;
  direction?: 'up' | 'down' | 'any';
}

export interface Alert {
  id: string;
  user_id: string;
  name: string;
  alert_type: 'price_change' | 'score_change' | 'threshold' | 'comparison';
  condition: AlertCondition;
  notify_email: boolean;
  notify_inapp: boolean;
  notify_sms: boolean;
  is_active: boolean;
  last_checked_at?: string;
  last_triggered_at?: string;
  trigger_count: number;
  created_at: string;
  updated_at: string;
}

interface UseAlertsOptions {
  userId?: string;
  autoLoad?: boolean;
}

interface UseAlertsReturn {
  alerts: Alert[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createAlert: (alert: Omit<Alert, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'trigger_count' | 'last_checked_at' | 'last_triggered_at'>) => Promise<Alert | null>;
  updateAlert: (id: string, updates: Partial<Alert>) => Promise<Alert | null>;
  deleteAlert: (id: string) => Promise<boolean>;
  toggleAlert: (id: string) => Promise<Alert | null>;
  activeCount: number;
}

export function useAlerts({
  userId,
  autoLoad = true,
}: UseAlertsOptions = {}): UseAlertsReturn {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/analytics/persistence/alerts?userId=${userId}`);
      const data = await response.json();

      if (data.success) {
        setAlerts(data.data || []);
      } else {
        setError(data.error || 'Failed to load alerts');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alerts');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (autoLoad && userId) {
      refresh();
    }
  }, [autoLoad, userId, refresh]);

  const createAlert = useCallback(
    async (
      alert: Omit<Alert, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'trigger_count' | 'last_checked_at' | 'last_triggered_at'>
    ): Promise<Alert | null> => {
      if (!userId) return null;

      try {
        const response = await fetch('/api/analytics/persistence/alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, ...alert }),
        });
        const data = await response.json();

        if (data.success) {
          setAlerts((prev) => [data.data, ...prev]);
          return data.data;
        }
        return null;
      } catch {
        return null;
      }
    },
    [userId]
  );

  const updateAlert = useCallback(
    async (id: string, updates: Partial<Alert>): Promise<Alert | null> => {
      if (!userId) return null;

      try {
        const response = await fetch(`/api/analytics/persistence/alerts/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, ...updates }),
        });
        const data = await response.json();

        if (data.success) {
          setAlerts((prev) =>
            prev.map((a) => (a.id === id ? data.data : a))
          );
          return data.data;
        }
        return null;
      } catch {
        return null;
      }
    },
    [userId]
  );

  const deleteAlert = useCallback(
    async (id: string): Promise<boolean> => {
      if (!userId) return false;

      try {
        const response = await fetch(
          `/api/analytics/persistence/alerts/${id}?userId=${userId}`,
          { method: 'DELETE' }
        );
        const data = await response.json();

        if (data.success) {
          setAlerts((prev) => prev.filter((a) => a.id !== id));
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [userId]
  );

  const toggleAlert = useCallback(
    async (id: string): Promise<Alert | null> => {
      if (!userId) return null;

      try {
        const response = await fetch(`/api/analytics/persistence/alerts/${id}/toggle`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
        const data = await response.json();

        if (data.success) {
          setAlerts((prev) =>
            prev.map((a) => (a.id === id ? data.data : a))
          );
          return data.data;
        }
        return null;
      } catch {
        return null;
      }
    },
    [userId]
  );

  const activeCount = alerts.filter((a) => a.is_active).length;

  return {
    alerts,
    isLoading,
    error,
    refresh,
    createAlert,
    updateAlert,
    deleteAlert,
    toggleAlert,
    activeCount,
  };
}
