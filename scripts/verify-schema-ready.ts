/**
 * Verify Database Schema is Ready for CSV Import
 *
 * Checks that all required columns exist before running the import
 *
 * Usage: npx tsx scripts/verify-schema-ready.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

interface ColumnCheck {
  table: string
  column: string
  required: boolean
}

const requiredColumns: ColumnCheck[] = [
  // tiger_states
  { table: 'tiger_states', column: 'state_abbreviation', required: true },
  { table: 'tiger_states', column: 'population', required: true },
  { table: 'tiger_states', column: 'name_fragment', required: true },

  // tiger_counties
  { table: 'tiger_counties', column: 'population', required: true },
  { table: 'tiger_counties', column: 'county_name_fragment', required: true },
  { table: 'tiger_counties', column: 'pct_of_state_population', required: true },

  // tiger_cbsa
  { table: 'tiger_cbsa', column: 'population', required: true },

  // tiger_zcta
  { table: 'tiger_zcta', column: 'population', required: true },
  { table: 'tiger_zcta', column: 'default_city', required: true },
  { table: 'tiger_zcta', column: 'default_state', required: true },
  { table: 'tiger_zcta', column: 'cbsa_code', required: true },
]

async function checkColumn(table: string, column: string): Promise<boolean> {
  try {
    // Try to select the column - if it doesn't exist, this will error
    const { error } = await supabase
      .from(table)
      .select(column)
      .limit(1)

    return !error
  } catch (err) {
    return false
  }
}

async function main() {
  console.log('🔍 Verifying Database Schema for CSV Import\n')
  console.log(`📡 Connected to: ${supabaseUrl}\n`)

  let allPassed = true
  const results: { table: string; column: string; exists: boolean }[] = []

  for (const check of requiredColumns) {
    const exists = await checkColumn(check.table, check.column)
    results.push({ table: check.table, column: check.column, exists })

    const status = exists ? '✅' : '❌'
    console.log(`${status} ${check.table}.${check.column}`)

    if (check.required && !exists) {
      allPassed = false
    }
  }

  console.log('\n' + '='.repeat(60))

  if (allPassed) {
    console.log('✅ Schema verification PASSED')
    console.log('\n✨ Ready to run: npx tsx scripts/import-normalization-csvs.ts')
    console.log('='.repeat(60))
    process.exit(0)
  } else {
    console.log('❌ Schema verification FAILED')
    console.log('\n⚠️  Missing required columns. Run the schema migration in Cursor first.')
    console.log('\nMissing columns:')
    results.filter(r => !r.exists).forEach(r => {
      console.log(`   - ${r.table}.${r.column}`)
    })
    console.log('='.repeat(60))
    process.exit(1)
  }
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message)
  process.exit(1)
})
