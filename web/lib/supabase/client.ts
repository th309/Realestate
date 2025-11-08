import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

/**
 * Browser client for Supabase
 * Use this in client components and browser-side code
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
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
        persistSession: false
      }
    }
  )
}

