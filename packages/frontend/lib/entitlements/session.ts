// packages/frontend/lib/entitlements/session.ts

/**
 * Anonymous session ID utility.
 * Generates a UUID-like session ID and stores it in sessionStorage
 * so it persists across page navigations but not across browser sessions.
 * Used for analytics tracking of anonymous visitors only.
 */

const SESSION_KEY = 'piq-anon-session-id';

export function getAnonymousSessionId(): string {
  if (typeof window === 'undefined') return '';

  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}
