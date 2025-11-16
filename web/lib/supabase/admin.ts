import { createClient } from '@supabase/supabase-js'
import { getEnv } from '@/lib/env'

/**
 * Admin client with service role key
 * Use this ONLY in API routes and server-side operations
 * Has full database access - keep secure!
 */
export function createSupabaseAdminClient() {
  try {
    const { supabaseUrl, supabaseServiceKey } = getEnv()

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials. Check your .env.local file.')
    }

    // Validate URL format
    try {
      new URL(supabaseUrl)
    } catch (urlError) {
      throw new Error(`Invalid Supabase URL format: ${supabaseUrl}`)
    }

    console.log(`🔌 Creating Supabase client with URL: ${supabaseUrl.substring(0, 30)}...`)

    // Next.js 16 has native fetch support, so we can use it directly
    const client = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: 'public'
      }
    })

    return client
  } catch (error: any) {
    console.error('❌ Error creating Supabase admin client:', error.message)
    if (error.stack) {
      console.error('   Stack:', error.stack.split('\n').slice(0, 5).join('\n'))
    }
    throw error
  }
}

