const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

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

export async function fetchAlerts(): Promise<Alert[]> {
  const res = await fetch(`${API_URL}/api/alerts`, { credentials: 'include' });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || data || [];
}

export async function createAlert(alert: Omit<Alert, 'id' | 'last_triggered_at' | 'created_at' | 'is_active'>): Promise<Alert | null> {
  const res = await fetch(`${API_URL}/api/alerts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(alert),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.data || data;
}

export async function updateAlert(id: string, updates: Partial<Pick<Alert, 'threshold' | 'condition' | 'is_active'>>): Promise<boolean> {
  const res = await fetch(`${API_URL}/api/alerts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(updates),
  });
  return res.ok;
}

export async function deleteAlert(id: string): Promise<boolean> {
  const res = await fetch(`${API_URL}/api/alerts/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return res.ok;
}

export async function fetchAlertHistory(): Promise<{ entries: AlertHistoryEntry[]; unreadCount: number }> {
  const res = await fetch(`${API_URL}/api/alerts/history`, { credentials: 'include' });
  if (!res.ok) return { entries: [], unreadCount: 0 };
  const data = await res.json();
  return { entries: data.data || [], unreadCount: data.unreadCount || 0 };
}

export async function markAlertRead(historyId: string): Promise<boolean> {
  const res = await fetch(`${API_URL}/api/alerts/history/${historyId}/read`, {
    method: 'PATCH',
    credentials: 'include',
  });
  return res.ok;
}
