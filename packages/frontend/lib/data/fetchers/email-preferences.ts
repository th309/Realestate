import { fetchAPI, fetchAPIRaw } from './base';

export interface EmailPreferences {
  weekly_digest: boolean;
  alert_emails: boolean;
  marketing: boolean;
}

export async function fetchEmailPreferences(): Promise<EmailPreferences> {
  return fetchAPI<EmailPreferences>('/api/email/preferences');
}

export async function updateEmailPreferences(updates: Partial<EmailPreferences>): Promise<void> {
  await fetchAPIRaw('/api/email/preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
}
