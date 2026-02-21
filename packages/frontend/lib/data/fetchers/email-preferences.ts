import { fetchAPIRaw } from './base';
import { getAuthHeaders } from './auth-headers';

export interface EmailPreferences {
  weekly_digest: boolean;
  alert_emails: boolean;
  marketing: boolean;
}

export async function fetchEmailPreferences(): Promise<EmailPreferences> {
  const authHeaders = await getAuthHeaders();
  const res = await fetchAPIRaw('/api/email/preferences', { headers: authHeaders });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function updateEmailPreferences(updates: Partial<EmailPreferences>): Promise<void> {
  const authHeaders = await getAuthHeaders();
  await fetchAPIRaw('/api/email/preferences', {
    method: 'PATCH',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
}
