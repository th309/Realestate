/**
 * Create performance indexes for data warehouse tables
 * Run with: npx tsx scripts/create-performance-indexes.ts
 */

import { createSupabaseAdminClient } from '../web/lib/supabase/admin'
import { SchemaBuilder } from '../web/lib/database/migrations'

async function createIndexes() {
  console.log('Creating performance indexes...\n')
  
  const supabase = createSupabaseAdminClient()
  const builder = new SchemaBuilder(supabase)
  
  const indexes = [
    {
      name: 'ix_stg_hpi_region_period',
      table: 'stg_redfin_hpi',
      columns: ['region', 'period'],
      unique: false
    },
    {
      name: 'ix_norm_link_file_raw',
      table: 'norm_match_link',
      columns: ['file_id', 'raw_name'],
      unique: false
    },
    {
      name: 'ix_fact_var_period',
      table: 'fact_observation',
      columns: ['variable_id', 'period_start'],
      unique: false
    }
  ]
  
  for (const index of indexes) {
    console.log(`Creating index: ${index.name} on ${index.table}(${index.columns.join(', ')})...`)
    
    builder.createIndex(
      index.name,
      index.table,
      index.columns,
      index.unique
    )
  }
  
  console.log('\nGenerated SQL:')
  console.log(builder.toSQL())
  console.log('\nExecuting...\n')
  
  const result = await builder.execute()
  
  if (result.success) {
    console.log('✅ All indexes created successfully!')
  } else {
    console.error('❌ Failed to create indexes:', result.error)
    process.exit(1)
  }
}

createIndexes().catch(console.error)

