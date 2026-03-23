import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

/**
 * Browser client for Supabase — SINGLETON.
 *
 * createBrowserClient() returns a new instance each time, so we cache
 * at module level. This ensures getSession() shares its internal cache
 * across all callers (useAuthState, getAuthHeaders, etc.), so the slow
 * token-refresh network call only happens once instead of per-caller.
 */
let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return browserClient;
}

/**
 * Server-side client with service role
 * Use this ONLY in API routes and server components
 * Has full database access - keep secure!
 */
export function createSupabaseServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
