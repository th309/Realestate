/**
 * Migration Runner
 * Tracks and executes database migrations in order
 */

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { executeSQL, Migration } from './migrations'

export interface MigrationRecord {
  id: number
  name: string
  executed_at: string
  success: boolean
  error?: string
}

/**
 * Create migrations tracking table if it doesn't exist
 */
export async function ensureMigrationsTable(): Promise<{ success: boolean; error?: string }> {
  const sql = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ DEFAULT NOW(),
      success BOOLEAN DEFAULT TRUE,
      error TEXT
    );
    
    CREATE INDEX IF NOT EXISTS idx_schema_migrations_name ON schema_migrations(name);
    CREATE INDEX IF NOT EXISTS idx_schema_migrations_executed ON schema_migrations(executed_at DESC);
  `
  
  return executeSQL(sql)
}

/**
 * Get list of executed migrations
 */
export async function getExecutedMigrations(): Promise<MigrationRecord[]> {
  const supabase = createSupabaseAdminClient()
  
  const { data, error } = await supabase
    .from('schema_migrations')
    .select('*')
    .order('executed_at', { ascending: true })
  
  if (error) {
    console.error('Error fetching migrations:', error)
    return []
  }
  
  return data || []
}

/**
 * Check if a migration has been executed
 */
export async function isMigrationExecuted(migrationName: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient()
  
  const { data, error } = await supabase
    .from('schema_migrations')
    .select('name')
    .eq('name', migrationName)
    .eq('success', true)
    .single()
  
  return !error && data !== null
}

/**
 * Record a migration as executed
 */
export async function recordMigration(
  migrationName: string,
  success: boolean,
  error?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseAdminClient()
  
  // Check if already recorded
  const existing = await isMigrationExecuted(migrationName)
  if (existing && success) {
    return { success: true }
  }
  
  // Insert or update migration record
  const { error: insertError } = await supabase
    .from('schema_migrations')
    .upsert({
      name: migrationName,
      executed_at: new Date().toISOString(),
      success,
      error: error || null
    }, {
      onConflict: 'name'
    })
  
  if (insertError) {
    return {
      success: false,
      error: insertError.message
    }
  }
  
  return { success: true }
}

/**
 * Run a single migration
 */
export async function runMigration(migration: Migration): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if already executed
    const executed = await isMigrationExecuted(migration.name)
    if (executed) {
      console.log(`⏭️  Migration ${migration.name} already executed, skipping`)
      return { success: true }
    }
    
    console.log(`▶️  Running migration: ${migration.name}`)
    console.log(`   ${migration.description}`)
    
    // Ensure migrations table exists
    await ensureMigrationsTable()
    
    // Run the migration
    const supabase = createSupabaseAdminClient()
    await migration.up(supabase)
    
    // Record success
    await recordMigration(migration.name, true)
    console.log(`✅ Migration ${migration.name} completed successfully`)
    
    return { success: true }
  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error'
    console.error(`❌ Migration ${migration.name} failed:`, errorMessage)
    
    // Record failure
    await recordMigration(migration.name, false, errorMessage)
    
    return {
      success: false,
      error: errorMessage
    }
  }
}

/**
 * Run all pending migrations
 */
export async function runPendingMigrations(migrations: Migration[]): Promise<{
  success: boolean
  executed: string[]
  failed: Array<{ name: string; error: string }>
}> {
  // Ensure migrations table exists
  await ensureMigrationsTable()
  
  const executed: string[] = []
  const failed: Array<{ name: string; error: string }> = []
  
  // Sort migrations by name (assuming they have version numbers or timestamps)
  const sortedMigrations = [...migrations].sort((a, b) => a.name.localeCompare(b.name))
  
  for (const migration of sortedMigrations) {
    const result = await runMigration(migration)
    
    if (result.success) {
      executed.push(migration.name)
    } else {
      failed.push({
        name: migration.name,
        error: result.error || 'Unknown error'
      })
      // Stop on first failure (optional - you might want to continue)
      break
    }
  }
  
  return {
    success: failed.length === 0,
    executed,
    failed
  }
}

/**
 * Rollback a migration (if down function exists)
 */
export async function rollbackMigration(migration: Migration): Promise<{ success: boolean; error?: string }> {
  if (!migration.down) {
    return {
      success: false,
      error: 'Migration does not have a rollback function'
    }
  }
  
  try {
    console.log(`⏪ Rolling back migration: ${migration.name}`)
    
    const supabase = createSupabaseAdminClient()
    await migration.down(supabase)
    
    // Remove migration record
    const { error } = await supabase
      .from('schema_migrations')
      .delete()
      .eq('name', migration.name)
    
    if (error) {
      console.warn('Warning: Could not remove migration record:', error.message)
    }
    
    console.log(`✅ Migration ${migration.name} rolled back successfully`)
    return { success: true }
  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error'
    console.error(`❌ Rollback of ${migration.name} failed:`, errorMessage)
    return {
      success: false,
      error: errorMessage
    }
  }
}

