/**
 * SQL Execution Utilities for Migrations
 */

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

/**
 * Execute raw SQL using Supabase admin client
 * Uses RPC function exec_sql if available, otherwise falls back to direct HTTP
 */
export async function executeSQL(sql: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createSupabaseAdminClient()

    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    for (const statement of statements) {
      if (statement.length === 0) continue

      // Try to execute via RPC function first
      const { error: rpcError } = await supabase.rpc('exec_sql', { query: statement })

      if (rpcError) {
        // If RPC doesn't exist or fails, try direct HTTP to Supabase REST API
        // This requires the service role key
        const { getEnv } = await import('@/lib/env')
        const { supabaseUrl, supabaseServiceKey } = getEnv()

        if (!supabaseUrl || !supabaseServiceKey) {
          throw new Error('Missing Supabase credentials. Cannot execute SQL.')
        }

        // Use Supabase REST API to execute SQL via PostgREST
        // Note: This requires the exec_sql function to exist
        // If it doesn't, we'll need to create it first via Supabase dashboard
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({ query: statement })
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`SQL execution failed: ${errorText}\nStatement: ${statement.substring(0, 100)}...`)
        }
      }
    }

    return { success: true }
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Create a helper RPC function in Supabase to execute SQL
 * This needs to be run once in Supabase SQL Editor:
 *
 * CREATE OR REPLACE FUNCTION exec_sql(query text)
 * RETURNS void
 * LANGUAGE plpgsql
 * SECURITY DEFINER
 * AS $$
 * BEGIN
 *   EXECUTE query;
 * END;
 * $$;
 */
export async function createSQLHelperFunction(): Promise<{ success: boolean; error?: string }> {
  const sql = `
    CREATE OR REPLACE FUNCTION exec_sql(query text)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      EXECUTE query;
    END;
    $$;
  `

  return executeSQL(sql)
}
