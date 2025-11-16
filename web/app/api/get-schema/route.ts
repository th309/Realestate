import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * Get current database schema
 * GET /api/get-schema
 * 
 * Queries the database to get table structures by:
 * 1. Querying each known table with LIMIT 1 to get column names and types
 * 2. Attempting to query information_schema if accessible
 */
export async function GET() {
  try {
    const supabase = createSupabaseAdminClient()
    const schema: any = {}

    // List of tables to inspect (we'll try to query them all)
    const tablesToCheck = [
      'markets',
      'market_time_series',
      'time_series_data',
      'current_scores',
      'user_favorites',
      'price_alerts',
      'user_subscriptions',
      'ai_cache',
      'tier_configs',
      'tiger_states',
      'tiger_counties',
      'tiger_cbsa',
      'tiger_places',
      'tiger_zcta',
      'geo_hierarchy'
    ]

    console.log('🔍 Inspecting database schema...')

    for (const tableName of tablesToCheck) {
      try {
        // Query table with limit 1 to get structure
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1)

        if (error) {
          // Table might not exist - that's okay
          if (error.code === '42P01' || error.message.includes('does not exist')) {
            console.log(`  ⚠️  Table ${tableName} does not exist`)
            continue
          }
          throw error
        }

        // If we got data, infer schema from first row
        if (data && data.length > 0) {
          const firstRow = data[0]
          const columns: any[] = []

          for (const [columnName, value] of Object.entries(firstRow)) {
            // Determine PostgreSQL type from JavaScript type and value
            let pgType = 'unknown'
            let maxLength: number | null = null
            let isNullable = true

            if (value === null) {
              pgType = 'unknown'
              isNullable = true
            } else if (typeof value === 'string') {
              pgType = 'text'
              if (value.length > 255) {
                pgType = 'text'
              } else {
                pgType = `varchar(${Math.max(value.length, 50)})`
                maxLength = Math.max(value.length, 50)
              }
            } else if (typeof value === 'number') {
              if (Number.isInteger(value)) {
                if (value > 2147483647) {
                  pgType = 'bigint'
                } else {
                  pgType = 'integer'
                }
              } else {
                pgType = 'numeric'
              }
            } else if (typeof value === 'boolean') {
              pgType = 'boolean'
            } else if (value instanceof Date) {
              pgType = 'timestamp'
            } else if (typeof value === 'object') {
              // Could be JSONB or JSON
              pgType = 'jsonb'
            }

            columns.push({
              column_name: columnName,
              data_type: pgType,
              max_length: maxLength,
              is_nullable: isNullable,
              sample_value: value,
              sample_type: typeof value
            })
          }

          schema[tableName] = {
            exists: true,
            columns: columns.sort((a, b) => a.column_name.localeCompare(b.column_name)),
            row_count: data.length
          }

          console.log(`  ✅ Found table ${tableName} with ${columns.length} columns`)
        } else {
          // Table exists but is empty
          schema[tableName] = {
            exists: true,
            columns: [],
            row_count: 0,
            note: 'Table exists but is empty - cannot infer schema'
          }
          console.log(`  ⚠️  Table ${tableName} exists but is empty`)
        }
      } catch (error: any) {
        console.error(`  ❌ Error querying table ${tableName}:`, error.message)
        schema[tableName] = {
          exists: false,
          error: error.message
        }
      }
    }

    // Try to get more detailed info by querying a table we know exists
    // Get a sample from markets table to see all columns
    try {
      const { data: sampleData } = await supabase
        .from('markets')
        .select('*')
        .limit(5)

      if (sampleData && sampleData.length > 0) {
        schema._sample_data = {
          markets: sampleData[0]
        }
      }
    } catch (e) {
      // Ignore
    }

    return NextResponse.json({
      success: true,
      schema,
      timestamp: new Date().toISOString(),
      note: 'Schema inferred from table queries. Column types are inferred from sample data and may not be exact.'
    })
  } catch (error: any) {
    console.error('Error getting schema:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack
      },
      { status: 500 }
    )
  }
}

