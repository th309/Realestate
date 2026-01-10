/**
 * Helper functions for common schema operations
 * Makes it easier to modify the database schema
 */

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { SchemaBuilder } from './migrations'

/**
 * Add a column to an existing table
 */
export async function addColumn(
  tableName: string,
  columnName: string,
  columnType: string,
  options?: {
    notNull?: boolean
    default?: string | number
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseAdminClient()
  const builder = new SchemaBuilder(supabase)
  
  builder.alterTable(tableName, (table) => {
    table.addColumn(columnName, columnType, options)
  })
  
  return builder.execute()
}

/**
 * Drop a column from a table
 */
export async function dropColumn(
  tableName: string,
  columnName: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseAdminClient()
  const builder = new SchemaBuilder(supabase)
  
  builder.alterTable(tableName, (table) => {
    table.dropColumn(columnName)
  })
  
  return builder.execute()
}

/**
 * Rename a column
 */
export async function renameColumn(
  tableName: string,
  oldName: string,
  newName: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseAdminClient()
  const builder = new SchemaBuilder(supabase)
  
  builder.alterTable(tableName, (table) => {
    table.renameColumn(oldName, newName)
  })
  
  return builder.execute()
}

/**
 * Modify column type
 */
export async function modifyColumnType(
  tableName: string,
  columnName: string,
  newType: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseAdminClient()
  const builder = new SchemaBuilder(supabase)
  
  builder.alterTable(tableName, (table) => {
    table.modifyColumn(columnName, newType)
  })
  
  return builder.execute()
}

/**
 * Create an index
 */
export async function createIndex(
  indexName: string,
  tableName: string,
  columns: string[],
  unique: boolean = false
): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseAdminClient()
  const builder = new SchemaBuilder(supabase)
  
  builder.createIndex(indexName, tableName, columns, unique)
  
  return builder.execute()
}

/**
 * Create a new table
 */
export async function createTable(
  tableName: string,
  definition: {
    columns: Array<{
      name: string
      type: string
      notNull?: boolean
      default?: string | number
      unique?: boolean
    }>
    primaryKey?: string[]
    timestamps?: boolean
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseAdminClient()
  const builder = new SchemaBuilder(supabase)
  
  builder.createTable(tableName, (table) => {
    definition.columns.forEach(col => {
      table.column(col.name, col.type, {
        notNull: col.notNull,
        default: col.default,
        unique: col.unique
      })
    })
    
    if (definition.primaryKey) {
      table.primaryKey(definition.primaryKey)
    }
    
    if (definition.timestamps) {
      table.timestamps()
    }
  })
  
  return builder.execute()
}


