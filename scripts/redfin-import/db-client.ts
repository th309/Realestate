/**
 * Database client utilities for Redfin import
 */

import * as path from 'path'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

/**
 * Create Supabase admin client for scripts
 */
export function createSupabaseAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase credentials. Check your .env.local file.')
  }

  try {
    new URL(supabaseUrl)
  } catch {
    throw new Error(`Invalid Supabase URL format: ${supabaseUrl}`)
  }

  const fetchImpl = typeof fetch !== 'undefined' ? fetch : undefined
  if (!fetchImpl) {
    throw new Error('fetch is not available. Node.js 18+ is required.')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      fetch: fetchImpl
    },
    db: {
      schema: 'public'
    }
  })
}

/**
 * Test database connection before starting import
 */
export async function testConnection(supabase: SupabaseClient): Promise<boolean> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    console.log('  🔌 Testing database connection...')
    console.log(`     URL: ${supabaseUrl?.substring(0, 50)}...`)

    // Test network connectivity
    try {
      const testUrl = `${supabaseUrl}/rest/v1/`
      console.log(`     Testing network connectivity to Supabase...`)
      const response = await fetch(testUrl, {
        method: 'HEAD',
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`
        },
        signal: AbortSignal.timeout(10000)
      })
      console.log(`     Network test: ${response.status} ${response.statusText}`)
    } catch (fetchError: any) {
      console.error(`  ❌ Network connectivity test failed: ${fetchError.message}`)
      console.error(`     Please check your internet connection and Supabase project status.`)
      return false
    }

    // Test Supabase query
    const { error } = await supabase
      .from('markets')
      .select('region_id')
      .limit(1)

    if (error) {
      console.error(`  ❌ Supabase query test failed: ${error.message}`)
      return false
    }

    console.log('  ✅ Database connection successful!')
    return true
  } catch (error: any) {
    console.error(`  ❌ Connection test exception: ${error.message}`)
    return false
  }
}

/**
 * Insert records into database with retry logic
 */
export async function insertRecordsBatch(
  supabase: SupabaseClient,
  tableName: string,
  records: any[],
  batchNum: number,
  totalBatches: number
): Promise<{ inserted: number; errors: number }> {
  let retries = 3
  let inserted = false
  let result = { inserted: 0, errors: 0 }

  while (retries > 0 && !inserted) {
    try {
      const { error } = await supabase
        .from(tableName)
        .upsert(records, {
          onConflict: 'geoid,metric_date',
          ignoreDuplicates: false
        })

      if (error) {
        const isConnectionError = error.message?.includes('fetch') ||
                                error.message?.includes('network') ||
                                error.message?.includes('ECONNREFUSED')

        if (isConnectionError && retries > 1) {
          retries--
          const delay = Math.pow(2, 3 - retries) * 1000
          console.warn(`  ⚠️  Connection error, retrying in ${delay}ms... (${retries} retries left)`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }

        console.error(`  ❌ Error inserting batch ${batchNum} into ${tableName}: ${error.message}`)
        result.errors++
        inserted = true
      } else {
        result.inserted = records.length
        if (batchNum === 1 || batchNum % 10 === 0 || batchNum === totalBatches) {
          console.log(`  ✅ Inserted batch ${batchNum}/${totalBatches} into ${tableName} (${records.length} records)`)
        }
        inserted = true
      }
    } catch (error: any) {
      const isConnectionError = error.message?.includes('fetch') || error.message?.includes('network')

      if (isConnectionError && retries > 1) {
        retries--
        const delay = Math.pow(2, 3 - retries) * 1000
        console.warn(`  ⚠️  Exception, retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }

      console.error(`  ❌ Exception inserting batch ${batchNum}: ${error.message}`)
      result.errors++
      inserted = true
    }
  }

  return result
}
