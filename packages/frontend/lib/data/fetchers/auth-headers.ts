/**
 * AUTH HEADERS UTILITY
 *
 * Retrieves the current Supabase session token and returns
 * authorization headers for backend API calls.
 */

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Get authorization headers with the current user's JWT token.
 * Returns an Authorization: Bearer header if the user is logged in,
 * otherwise returns an empty object.
 *
 * Usage:
 *   const headers = await getAuthHeaders();
 *   fetch(url, { headers: { ...headers, 'Content-Type': 'application/json' } });
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` };
    }
  } catch {
    // Silent fail — unauthenticated requests will be handled by the backend
  }

  return {};
}
