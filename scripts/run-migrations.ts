/**
 * Run all pending migrations
 * Usage: npx tsx scripts/run-migrations.ts
 */

import { runPendingMigrations, getExecutedMigrations } from '../web/lib/database/migration-runner'
import { Migration } from '../web/lib/database/migrations'
import { SchemaBuilder } from '../web/lib/database/migrations'
import { createSupabaseAdminClient } from '../web/lib/supabase/admin'

// Import migrations
import { consolidateGeographicTables } from './migrations/001-consolidate-geographic-tables'
import { dropGeoDataTable } from './migrations/002-drop-geo-data-table'

async function main() {
  console.log('🚀 Starting migration runner...\n')
  
  // Get executed migrations
  const executed = await getExecutedMigrations()
  console.log(`📋 Found ${executed.length} executed migration(s)`)
  if (executed.length > 0) {
    console.log('   Executed migrations:')
    executed.forEach(m => {
      console.log(`   - ${m.name} (${m.executed_at})`)
    })
  }
  console.log()
  
  // Define migrations to run
  const migrations: Migration[] = [
    consolidateGeographicTables,
    // dropGeoDataTable, // Uncomment after verifying migration 001 works
  ]
  
  if (migrations.length === 0) {
    console.log('ℹ️  No migrations to run')
    return
  }
  
  console.log(`📦 Found ${migrations.length} migration(s) to check\n`)
  
  // Run pending migrations
  const result = await runPendingMigrations(migrations)
  
  console.log('\n📊 Migration Summary:')
  console.log(`   ✅ Executed: ${result.executed.length}`)
  console.log(`   ❌ Failed: ${result.failed.length}`)
  
  if (result.executed.length > 0) {
    console.log('\n   Executed migrations:')
    result.executed.forEach(name => {
      console.log(`   - ${name}`)
    })
  }
  
  if (result.failed.length > 0) {
    console.log('\n   Failed migrations:')
    result.failed.forEach(({ name, error }) => {
      console.log(`   - ${name}: ${error}`)
    })
    process.exit(1)
  }
  
  console.log('\n✅ All migrations completed successfully!')
}

main().catch(console.error)

