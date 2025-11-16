/**
 * Migration: Drop geo_data table after consolidation
 * Purpose: Remove redundant geo_data table after migration to markets
 * 
 * WARNING: Only run this after:
 * 1. Migration 001 has been run successfully
 * 2. All data has been migrated from geo_data to markets
 * 3. All code references have been updated
 * 4. All imports are working correctly
 */

import { Migration, executeSQL } from '../../web/lib/database/migrations'
import * as fs from 'fs'
import * as path from 'path'

const sqlFile = path.join(__dirname, '002-drop-geo-data-table.sql')
const sql = fs.readFileSync(sqlFile, 'utf-8')

export const dropGeoDataTable: Migration = {
  name: '20241201_drop_geo_data_table',
  description: 'Drop redundant geo_data table after consolidation (only if empty)',
  up: async (supabase) => {
    console.log('📦 Running migration: Drop geo_data Table')
    console.log('   - Verifying migration is complete')
    console.log('   - Dropping geo_data table if empty')
    
    const result = await executeSQL(sql)
    if (!result.success) {
      throw new Error(result.error || 'Migration failed')
    }
    
    console.log('✅ Migration completed successfully')
  },
  down: async (supabase) => {
    // Rollback would require recreating geo_data table - not implemented
    console.warn('⚠️  Rollback not implemented for this migration')
    throw new Error('Rollback not supported for this migration')
  }
}

