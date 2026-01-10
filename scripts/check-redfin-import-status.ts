/**
 * Check Redfin import status - query tables to see how many records were imported
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase credentials. Check your .env.local file.')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

async function checkImportStatus() {
  const supabase = createSupabaseAdminClient()
  
  console.log('\n📊 Checking Redfin Import Status')
  console.log('='.repeat(60))
  
  const tables = ['redfin_metrics', 'redfin_metrics_2024', 'redfin_metrics_2025']
  
  for (const tableName of tables) {
    try {
      // Count total records
      const { count, error: countError } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })
      
      if (countError) {
        console.error(`  ❌ Error counting ${tableName}: ${countError.message}`)
        continue
      }
      
      console.log(`\n📋 ${tableName}:`)
      console.log(`   Total records: ${count?.toLocaleString() || 0}`)
      
      if (count && count > 0) {
        // Get sample records
        const { data: samples, error: sampleError } = await supabase
          .from(tableName)
          .select('geoid, metric_date, median_sale_price, homes_sold, new_listings')
          .limit(5)
        
        if (!sampleError && samples && samples.length > 0) {
          console.log(`   Sample records:`)
          samples.forEach((record, idx) => {
            console.log(`     ${idx + 1}. geoid: ${record.geoid}, date: ${record.metric_date}, price: ${record.median_sale_price || 'N/A'}, sold: ${record.homes_sold || 'N/A'}`)
          })
        }
        
        // Get date range
        const { data: dateRange, error: dateError } = await supabase
          .from(tableName)
          .select('metric_date')
          .order('metric_date', { ascending: true })
          .limit(1)
        
        const { data: dateRangeEnd, error: dateErrorEnd } = await supabase
          .from(tableName)
          .select('metric_date')
          .order('metric_date', { ascending: false })
          .limit(1)
        
        if (!dateError && !dateErrorEnd && dateRange && dateRangeEnd) {
          console.log(`   Date range: ${dateRange[0].metric_date} to ${dateRangeEnd[0].metric_date}`)
        }
        
        // Count unique geoids
        const { data: geoids, error: geoidError } = await supabase
          .from(tableName)
          .select('geoid')
        
        if (!geoidError && geoids) {
          const uniqueGeoids = new Set(geoids.map(g => g.geoid))
          console.log(`   Unique geoids: ${uniqueGeoids.size.toLocaleString()}`)
        }
      }
    } catch (error: any) {
      console.error(`  ❌ Error checking ${tableName}: ${error.message}`)
    }
  }
  
  console.log('\n' + '='.repeat(60))
}

checkImportStatus().catch((error) => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})


