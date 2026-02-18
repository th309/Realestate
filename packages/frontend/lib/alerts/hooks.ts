'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchAlerts,
  fetchAlertHistory,
  createAlert,
  deleteAlert,
  updateAlert,
  markAlertRead,
} from '@/lib/data';
import type { Alert, AlertHistoryEntry } from '@/lib/data';

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const data = await fetchAlerts();
    setAlerts(data);
    setIsLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const add = useCallback(async (alert: Parameters<typeof createAlert>[0]) => {
    const result = await createAlert(alert);
    if (result) setAlerts(prev => [result, ...prev]);
    return result;
  }, []);

  const remove = useCallback(async (id: string) => {
    const ok = await deleteAlert(id);
    if (ok) setAlerts(prev => prev.filter(a => a.id !== id));
    return ok;
  }, []);

  const update = useCallback(async (id: string, updates: Parameters<typeof updateAlert>[1]) => {
    const ok = await updateAlert(id, updates);
    if (ok) {
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    }
    return ok;
  }, []);

  return { alerts, isLoading, refresh, add, remove, update };
}

export function useAlertHistory() {
  const [entries, setEntries] = useState<AlertHistoryEntry[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const data = await fetchAlertHistory();
    setEntries(data.entries);
    setUnreadCount(data.unreadCount);
    setIsLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const markRead = useCallback(async (historyId: string) => {
    const ok = await markAlertRead(historyId);
    if (ok) {
      setEntries(prev => prev.map(e => e.id === historyId ? { ...e, read_at: new Date().toISOString() } : e));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    return ok;
  }, []);

  return { entries, unreadCount, isLoading, refresh, markRead };
}
