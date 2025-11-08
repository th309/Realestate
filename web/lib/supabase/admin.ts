import { createClient } from '@supabase/supabase-js'
import { getEnv } from '@/lib/env'

/**
 * Admin client with service role key
 * Use this ONLY in API routes and server-side operations
 * Has full database access - keep secure!
 */
export function createSupabaseAdminClient() {
  const { supabaseUrl, supabaseServiceKey } = getEnv()

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

