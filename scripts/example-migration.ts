/**
 * Example migration script
 * Run with: npx tsx scripts/example-migration.ts
 */

import { createSupabaseAdminClient } from '../web/lib/supabase/admin'
import { SchemaBuilder, addColumn, createIndex } from '../web/lib/database/migrations'

async function runExampleMigration() {
  console.log('Running example migration...')
  
  const supabase = createSupabaseAdminClient()
  
  // Example 1: Add a column
  console.log('\n1. Adding column to markets table...')
  const result1 = await addColumn(
    'markets',
    'example_field',
    'VARCHAR(255)',
    { notNull: false }
  )
  
  if (result1.success) {
    console.log('✓ Column added successfully')
  } else {
    console.error('✗ Failed to add column:', result1.error)
  }
  
  // Example 2: Create an index
  console.log('\n2. Creating index...')
  const result2 = await createIndex(
    'idx_markets_example',
    'markets',
    ['example_field'],
    false
  )
  
  if (result2.success) {
    console.log('✓ Index created successfully')
  } else {
    console.error('✗ Failed to create index:', result2.error)
  }
  
  // Example 3: Complex schema changes
  console.log('\n3. Making complex schema changes...')
  const builder = new SchemaBuilder(supabase)
  
  builder
    .alterTable('markets', (table) => {
      table.addColumn('another_field', 'INTEGER', { default: 0 })
      table.setColumnNotNull('example_field')
    })
    .createIndex('idx_markets_another', 'markets', ['another_field'])
  
  const result3 = await builder.execute()
  
  if (result3.success) {
    console.log('✓ Complex changes applied successfully')
    console.log('\nGenerated SQL:')
    console.log(builder.toSQL())
  } else {
    console.error('✗ Failed to apply changes:', result3.error)
  }
  
  console.log('\nMigration complete!')
}

runExampleMigration().catch(console.error)


