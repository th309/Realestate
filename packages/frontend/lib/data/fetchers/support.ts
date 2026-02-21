import { fetchAPIRaw } from './base';
import { getAuthHeaders } from './auth-headers';

export interface SupportTicket {
  issue_type: 'bug' | 'feature_request' | 'billing' | 'general';
  description: string;
  email_override?: string;
}

export async function submitSupportTicket(ticket: SupportTicket): Promise<void> {
  const authHeaders = await getAuthHeaders();
  const res = await fetchAPIRaw('/api/support/tickets', {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(ticket),
  });
  if (!res.ok) {
    throw new Error('Failed to submit support ticket');
  }
}
