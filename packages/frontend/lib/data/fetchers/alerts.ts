/**
 * ALERT DATA FETCHERS
 *
 * API functions for user alert management and alert history.
 */

import { fetchAPIRaw } from './base';
import { getAuthHeaders } from './auth-headers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Alert {
  id: string;
  geography_type: string;
  geography_id: string;
  geography_name: string;
  metric_id: string;
  condition: 'above' | 'below' | 'crosses';
  threshold: number;
  is_active: boolean;
  last_triggered_at: string | null;
  created_at: string;
}

export interface AlertHistoryEntry {
  id: string;
  alert_id: string;
  triggered_at: string;
  metric_value: number;
  notified_via: string;
  read_at: string | null;
  // Joined from alert
  alert?: Alert;
}

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

/**
 * Fetch all alerts for the current user.
 */
export async function fetchAlerts(): Promise<Alert[]> {
  const authHeaders = await getAuthHeaders();
  const res = await fetchAPIRaw('/api/alerts', { headers: authHeaders });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || data || [];
}

/**
 * Create a new alert.
 */
export async function createAlert(
  alert: Omit<Alert, 'id' | 'last_triggered_at' | 'created_at' | 'is_active'>,
): Promise<Alert | null> {
  const authHeaders = await getAuthHeaders();
  const res = await fetchAPIRaw('/api/alerts', {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(alert),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.data || data;
}

/**
 * Update an existing alert (threshold, condition, or active status).
 */
export async function updateAlert(
  id: string,
  updates: Partial<Pick<Alert, 'threshold' | 'condition' | 'is_active'>>,
): Promise<boolean> {
  const authHeaders = await getAuthHeaders();
  const res = await fetchAPIRaw(`/api/alerts/${id}`, {
    method: 'PATCH',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  return res.ok;
}

/**
 * Delete an alert.
 */
export async function deleteAlert(id: string): Promise<boolean> {
  const authHeaders = await getAuthHeaders();
  const res = await fetchAPIRaw(`/api/alerts/${id}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  return res.ok;
}

/**
 * Fetch alert history (triggered alert entries) for the current user.
 */
export async function fetchAlertHistory(): Promise<{
  entries: AlertHistoryEntry[];
  unreadCount: number;
}> {
  const authHeaders = await getAuthHeaders();
  const res = await fetchAPIRaw('/api/alerts/history', { headers: authHeaders });
  if (!res.ok) return { entries: [], unreadCount: 0 };
  const data = await res.json();
  return { entries: data.data || [], unreadCount: data.unreadCount || 0 };
}

/**
 * Mark an alert history entry as read.
 */
export async function markAlertRead(historyId: string): Promise<boolean> {
  const authHeaders = await getAuthHeaders();
  const res = await fetchAPIRaw(`/api/alerts/history/${historyId}/read`, {
    method: 'PATCH',
    headers: authHeaders,
  });
  return res.ok;
}
