/**
 * Migration: Consolidate Geographic Tables
 * Purpose: Migrate from geo_data to markets table, maintain hierarchy and mapping
 */

import { Migration, executeSQL } from '../../web/lib/database/migrations'
import * as fs from 'fs'
import * as path from 'path'

const sqlFile = path.join(__dirname, '001-consolidate-geographic-tables.sql')
const sql = fs.readFileSync(sqlFile, 'utf-8')

export const consolidateGeographicTables: Migration = {
  name: '20241201_consolidate_geographic_tables',
  description: 'Consolidate geo_data table into markets table, add TIGER GEOID support, update foreign keys',
  up: async (supabase) => {
    console.log('📦 Running migration: Consolidate Geographic Tables')
    console.log('   - Enhancing markets table with GEOID support')
    console.log('   - Migrating data from geo_data to markets')
    console.log('   - Updating foreign key constraints')
    console.log('   - Creating helper functions and views')
    
    const result = await executeSQL(sql)
    if (!result.success) {
      throw new Error(result.error || 'Migration failed')
    }
    
    console.log('✅ Migration completed successfully')
  },
  down: async (supabase) => {
    // Rollback would be complex - we'll leave this as a manual operation if needed
    console.warn('⚠️  Rollback not implemented for this migration')
    throw new Error('Rollback not supported for this migration')
  }
}

