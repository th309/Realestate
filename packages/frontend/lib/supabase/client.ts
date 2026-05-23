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

// Serialize auth operations (getSession / token refresh) without using
// navigator.locks. Supabase's default lock uses navigator.locks with "steal"
// mode, which threw "Lock broken by another request with the 'steal' option"
// AbortErrors in Next.js 16 when multiple components call getSession()
// concurrently. The previous fix replaced it with a NO-OP lock — but that
// removed serialization entirely, letting concurrent callers race the token
// refresh and intermittently resolve the session as `null` on cold load
// (the cause of admins seeing the free tier and Realtime joining as anon).
// A plain promise-chain mutex keeps the serialization the refresh relies on
// while avoiding navigator.locks' steal semantics.
const authLockChains = new Map<string, Promise<unknown>>();

async function serializingAuthLock<R>(
  name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>,
): Promise<R> {
  const prior = authLockChains.get(name) ?? Promise.resolve();
  // Run fn after the prior holder settles, whether it resolved or rejected.
  const run = prior.then(fn, fn);
  // Chain the next waiter on a swallowed copy so one failure can't poison the queue.
  authLockChains.set(
    name,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

export function createSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          flowType: "implicit",
          lock: serializingAuthLock,
        },
      },
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
